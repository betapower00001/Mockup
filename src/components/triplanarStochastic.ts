"use client";

import * as THREE from "three";

export type TriplanarOptions = {
  scale?: number; // ความถี่ลาย (ยิ่งมากยิ่งถี่)
  blend?: number; // ความนุ่มการ blend (ยิ่งมากยิ่งนุ่ม)
  seed?: number;  // ความสุ่ม
  zoom?: number;  // >= 1
  offsetX?: number; // 0..1
  offsetY?: number; // 0..1
};

export function applyTriplanarStochasticToMaterial(
  mat: THREE.Material,
  mapTex: THREE.Texture,
  opts?: TriplanarOptions
) {
  const m = mat as any;
  if (!m) return;

  // ✅ ตั้งค่า texture (ทุกครั้ง) เผื่อเปลี่ยนลาย
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.wrapS = mapTex.wrapT = THREE.RepeatWrapping;
  (mapTex as any).flipY = false;
  mapTex.needsUpdate = true;

  // ✅ สำคัญ: บังคับให้ three เปิด USE_MAP (ไม่งั้น #ifdef USE_MAP ไม่ทำงาน)
  m.map = mapTex;

  // ✅ ถ้าเคย patch แล้ว → อัปเดต uniforms/texture แล้วจบ
  if (m.userData?.__TRI_PATCHED__ && m.userData?.__TRI_UNIFORMS__) {
    const u = m.userData.__TRI_UNIFORMS__;

    // อัปเดต map ที่ใช้ใน shader
    u.uTriplanarMap.value = mapTex;

    if (opts?.scale != null) u.uTriScale.value = opts.scale;
    if (opts?.blend != null) u.uTriBlend.value = opts.blend;
    if (opts?.seed != null) u.uTriSeed.value = opts.seed;
    if (opts?.zoom != null) u.uTriZoom.value = Math.max(1, opts.zoom);

    if (opts?.offsetX != null || opts?.offsetY != null) {
      const ox = opts?.offsetX ?? u.uTriOffset.value.x;
      const oy = opts?.offsetY ?? u.uTriOffset.value.y;
      u.uTriOffset.value.set(ox, oy);
    }

    m.needsUpdate = true;
    return;
  }

  // Material ต้องมี onBeforeCompile
  if (typeof m.onBeforeCompile !== "function") return;

  const uniforms = {
    uTriplanarMap: { value: mapTex },
    uTriScale: { value: opts?.scale ?? 2.5 },
    uTriBlend: { value: opts?.blend ?? 6.0 },
    uTriSeed: { value: opts?.seed ?? 1.0 },
    uTriZoom: { value: Math.max(1, opts?.zoom ?? 1) },
    uTriOffset: { value: new THREE.Vector2(opts?.offsetX ?? 0.0, opts?.offsetY ?? 0.0) },
  };

  m.userData = m.userData || {};
  m.userData.__TRI_UNIFORMS__ = uniforms;

  m.onBeforeCompile = (shader: any) => {
    shader.uniforms.uTriplanarMap = uniforms.uTriplanarMap;
    shader.uniforms.uTriScale = uniforms.uTriScale;
    shader.uniforms.uTriBlend = uniforms.uTriBlend;
    shader.uniforms.uTriSeed = uniforms.uTriSeed;
    shader.uniforms.uTriZoom = uniforms.uTriZoom;
    shader.uniforms.uTriOffset = uniforms.uTriOffset;

    // ✅ inject varyings
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
      `
    );

    // ✅ world position
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
#include <begin_vertex>
vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
vWorldPos = worldPos.xyz;
      `
    );

    // ✅ world normal (แก้ ERROR: ไม่ใช้ objectNormal)
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `
#include <beginnormal_vertex>
vWorldNormal = normalize(mat3(modelMatrix) * normal);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

uniform sampler2D uTriplanarMap;
uniform float uTriScale;
uniform float uTriBlend;
uniform float uTriSeed;
uniform float uTriZoom;
uniform vec2 uTriOffset;

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

mat2 rot2(float a){
  float s = sin(a), c = cos(a);
  return mat2(c,-s,s,c);
}

vec4 sampleStochastic(sampler2D tex, vec2 uv, float seed){
  vec2 p = uv;
  vec2 i = floor(p);
  vec2 f = fract(p);

  float r = hash12(i + seed);
  float ang = r * 6.2831853;

  vec2 jitter = vec2(hash12(i + 17.0 + seed), hash12(i + 37.0 + seed));

  vec2 fu = f - 0.5;
  fu = rot2(ang) * fu;
  fu += 0.5;

  vec2 uv2 = (i + fu + (jitter - 0.5) * 0.35);

  // zoom/pan
  uv2 = (uv2 / uTriZoom) + uTriOffset;

  return texture2D(tex, uv2);
}

vec4 triplanarColor(vec3 wPos, vec3 wN){
  vec3 n = normalize(wN);
  vec3 an = abs(n);

  vec3 w = pow(an, vec3(uTriBlend));
  w /= (w.x + w.y + w.z + 1e-6);

  vec2 uvX = wPos.yz * uTriScale;
  vec2 uvY = wPos.xz * uTriScale;
  vec2 uvZ = wPos.xy * uTriScale;

  vec4 cx = sampleStochastic(uTriplanarMap, uvX, uTriSeed + 1.0);
  vec4 cy = sampleStochastic(uTriplanarMap, uvY, uTriSeed + 2.0);
  vec4 cz = sampleStochastic(uTriplanarMap, uvZ, uTriSeed + 3.0);

  return cx * w.x + cy * w.y + cz * w.z;
}
      `
    );

    // ✅ ใช้ map_fragment เป็น trigger (เพราะ USE_MAP เปิดแล้ว)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = triplanarColor(vWorldPos, vWorldNormal);
  diffuseColor *= sampledDiffuseColor;
#endif
      `
    );
  };

  m.userData.__TRI_PATCHED__ = true;
  m.needsUpdate = true;
}

export function setTriplanarUniforms(mat: THREE.Material, opts?: TriplanarOptions) {
  const m = mat as any;
  const u = m?.userData?.__TRI_UNIFORMS__;
  if (!u) return;

  if (opts?.scale != null) u.uTriScale.value = opts.scale;
  if (opts?.blend != null) u.uTriBlend.value = opts.blend;
  if (opts?.seed != null) u.uTriSeed.value = opts.seed;
  if (opts?.zoom != null) u.uTriZoom.value = Math.max(1, opts.zoom);

  if (opts?.offsetX != null || opts?.offsetY != null) {
    const ox = opts?.offsetX ?? u.uTriOffset.value.x;
    const oy = opts?.offsetY ?? u.uTriOffset.value.y;
    u.uTriOffset.value.set(ox, oy);
  }
}
