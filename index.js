// ===== 設定 =====
const MODEL_URL = "https://raw.githubusercontent.com/supermanone-boop/Fighter-Jet/main/textured.glb";

const ac = geofs.aircraft.instance;
const viewer = geofs.api.viewer;
const scene = viewer.scene;

// ===== 敵状態 =====
let target = {};

function resetTarget() {
  target.lat = ac.llaLocation[0] + (Math.random() - 0.5) * 0.05;
  target.lon = ac.llaLocation[1] + (Math.random() - 0.5) * 0.05;
  target.alt = ac.llaLocation[2] + 1500;
  target.heading = Math.random() * 360;
  target.speed = 250;
  target.climb = 0;
  target.roll = 0;
}

resetTarget();

// ===== モデル =====
let model = scene.primitives.add(
  Cesium.Model.fromGltf({
    url: MODEL_URL,
    modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.alt)
    ),
    scale: 25.0
  })
);

// ===== レーダーUI =====
let radar = document.createElement("div");
radar.style.position = "fixed";
radar.style.right = "20px";
radar.style.bottom = "20px";
radar.style.width = "150px";
radar.style.height = "150px";
radar.style.background = "rgba(0,0,0,0.6)";
radar.style.border = "2px solid #0f0";
radar.style.borderRadius = "10px";
radar.style.zIndex = "9999";
radar.style.boxShadow = "0 0 10px #0f0 inset";
document.body.appendChild(radar);

// 自機点
let selfDot = document.createElement("div");
selfDot.style.position = "absolute";
selfDot.style.width = "6px";
selfDot.style.height = "6px";
selfDot.style.background = "#0f0";
selfDot.style.borderRadius = "50%";
selfDot.style.left = "50%";
selfDot.style.top = "50%";
selfDot.style.transform = "translate(-50%, -50%)";
radar.appendChild(selfDot);

// 敵点
let enemyDot = document.createElement("div");
enemyDot.style.position = "absolute";
enemyDot.style.width = "6px";
enemyDot.style.height = "6px";
enemyDot.style.background = "red";
enemyDot.style.borderRadius = "50%";
radar.appendChild(enemyDot);

// ===== RESETボタン =====
let resetBtn = document.createElement("button");
resetBtn.innerText = "RESET";
resetBtn.style.position = "fixed";
resetBtn.style.right = "20px";
resetBtn.style.bottom = "190px";
resetBtn.style.padding = "10px";
resetBtn.style.background = "#111";
resetBtn.style.color = "#0f0";
resetBtn.style.border = "2px solid #0f0";
resetBtn.style.zIndex = "9999";
document.body.appendChild(resetBtn);

resetBtn.onclick = resetTarget;

// ===== 地形 =====
function getGroundHeight(lat, lon) {
  const carto = Cesium.Cartographic.fromDegrees(lon, lat);
  return viewer.scene.globe.getHeight(carto) || 0;
}

// ===== 自機地上判定 =====
function isPlayerOnGround() {
  const ground = getGroundHeight(ac.llaLocation[0], ac.llaLocation[1]);
  return ac.llaLocation[2] <= ground + 5;
}

// ===== 距離 =====
function getDistance() {
  const dLat = (ac.llaLocation[0] - target.lat) * 111000;
  const dLon = (ac.llaLocation[1] - target.lon) * 111000 * Math.cos(target.lat * Math.PI / 180);
  const dAlt = ac.llaLocation[2] - target.alt;
  return Math.sqrt(dLat*dLat + dLon*dLon + dAlt*dAlt);
}

// ===== AI =====
function updateTarget() {

  // ===== 地上待機 =====
  if (isPlayerOnGround()) {

    const dLat = ac.llaLocation[0] - target.lat;
    const dLon = ac.llaLocation[1] - target.lon;

    target.lat += dLat * 0.02;
    target.lon += dLon * 0.02;

    const ground = getGroundHeight(target.lat, target.lon);
    target.alt = ground + 5;

    target.speed = 0;
    target.roll = 0;

    target.heading = Math.atan2(dLon, dLat) * 180 / Math.PI;

  } else {

    // ===== 常時追尾AI =====
    const dist = getDistance();

    const dLat = ac.llaLocation[0] - target.lat;
    const dLon = ac.llaLocation[1] - target.lon;

    const angleToPlayer = Math.atan2(dLon, dLat) * 180 / Math.PI;

    if (dist < 800) {
      // 回避
      const escape = angleToPlayer + 180;

      target.heading += (escape - target.heading) * 0.12;
      target.speed = 420;
      target.climb += (Math.random() - 0.5) * 8;
      target.roll = (escape - target.heading) * 0.7;

    } else {
      // 常時追尾

      let diff = angleToPlayer - target.heading;
      diff = Math.atan2(Math.sin(diff * Math.PI/180), Math.cos(diff * Math.PI/180)) * 180/Math.PI;

      target.heading += diff * 0.08;

      target.speed = Math.min(450, 250 + dist * 0.05);

      const altDiff = ac.llaLocation[2] - target.alt;
      target.climb += altDiff * 0.002;

      target.roll = diff * 0.5;
    }

    target.climb *= 0.98;

    const rad = target.heading * Math.PI / 180;

    target.lat += Math.cos(rad) * target.speed / 111000 * 0.016;
    target.lon += Math.sin(rad) * target.speed / (111000 * Math.cos(target.lat * Math.PI / 180)) * 0.016;
    target.alt += target.climb;
  }

  // ===== モデル更新 =====
  const pos = Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.alt);

  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(target.heading),
    0,
    Cesium.Math.toRadians(target.roll)
  );

  model.modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);

  // 発光
  model.colorBlendMode = Cesium.ColorBlendMode.MIX;
  model.colorBlendAmount = 0.7;
}

// ===== レーダー =====
function updateRadar() {

  const range = 3000;

  const dLat = (target.lat - ac.llaLocation[0]) * 111000;
  const dLon = (target.lon - ac.llaLocation[1]) * 111000 * Math.cos(ac.llaLocation[0] * Math.PI / 180);

  const heading = ac.htr[0] * Math.PI / 180;

  const x = dLon * Math.cos(-heading) - dLat * Math.sin(-heading);
  const y = dLon * Math.sin(-heading) + dLat * Math.cos(-heading);

  let rx = Math.max(-1, Math.min(1, x / range));
  let ry = Math.max(-1, Math.min(1, y / range));

  const px = 75 + rx * 70;
  const py = 75 - ry * 70;

  enemyDot.style.left = px + "px";
  enemyDot.style.top = py + "px";

  let dist = getDistance();
  enemyDot.style.background = dist < 500 ? "red" : dist < 1500 ? "yellow" : "white";
  enemyDot.style.opacity = dist > 3000 ? 0.3 : 1;
}

// ===== ループ =====
function loop() {
  updateTarget();
  updateRadar();
  requestAnimationFrame(loop);
}

loop();