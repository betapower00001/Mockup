// src/components/FitToObject.tsx
"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { Box3, Vector3 } from "three";
import { useThree } from "@react-three/fiber";

type Props = {
  object: THREE.Object3D | null;
  padding?: number;
  yOffset?: number;
};

export default function FitToObject({ object, padding = 1.25, yOffset = 0 }: Props) {
  const { camera, controls } = useThree() as any;

  useEffect(() => {
    if (!object) return;

    const box = new Box3().setFromObject(object);
    const size = new Vector3();
    const center = new Vector3();

    box.getSize(size);
    box.getCenter(center);
    center.y += yOffset;

    const maxSize = Math.max(size.x, size.y, size.z);
    const fov = (camera.fov * Math.PI) / 180;
    const distance = (maxSize / (2 * Math.tan(fov / 2))) * padding;

    camera.position.set(center.x, center.y, center.z + distance);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    if (controls?.target) {
      controls.target.copy(center);
      controls.update();
    } else {
      camera.lookAt(center);
    }
  }, [object, padding, yOffset, camera, controls]);

  return null;
}
