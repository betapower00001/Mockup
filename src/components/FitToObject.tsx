// src/components/FitToObject.tsx
"use client";

import { useLayoutEffect } from "react";
import * as THREE from "three";
import { Box3, Vector3 } from "three";
import { useThree } from "@react-three/fiber";

type Props = {
  object: THREE.Object3D | null;
  padding?: number;
  yOffset?: number;
};

export default function FitToObject({ object, padding = 0.94, yOffset = 0 }: Props) {
  const { camera, controls, size, invalidate } = useThree() as any;

  useLayoutEffect(() => {
    if (!object) return;

    let raf1 = 0;
    let raf2 = 0;

    const fit = () => {
      if (!object) return;

      object.updateWorldMatrix(true, true);

      const box = new Box3().setFromObject(object);
      if (box.isEmpty()) return;

      const objSize = new Vector3();
      const center = new Vector3();

      box.getSize(objSize);
      box.getCenter(center);
      center.y += yOffset;

      const safeX = Math.max(objSize.x, 0.0001);
      const safeY = Math.max(objSize.y, 0.0001);
      const safeZ = Math.max(objSize.z, 0.0001);

      const fov = (camera.fov * Math.PI) / 180;
      const aspect = Math.max(1e-6, size.width / Math.max(size.height, 1));

      const fitHeightDistance = safeY / (2 * Math.tan(fov / 2));
      const fitWidthDistance = safeX / (2 * Math.tan(fov / 2)) / aspect;
      const fitDepthDistance = safeZ * 1.15;

      const distance = Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance) * padding;

      camera.position.set(center.x, center.y, center.z + distance);
      camera.near = Math.max(0.01, distance / 100);
      camera.far = Math.max(100, distance * 100);
      camera.updateProjectionMatrix();

      if (controls?.target) {
        controls.target.copy(center);
        controls.update();
      } else {
        camera.lookAt(center);
      }

      invalidate?.();
    };

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(fit);
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [object, padding, yOffset, camera, controls, size.width, size.height, invalidate]);

  return null;
}
