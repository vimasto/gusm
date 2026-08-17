"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import Image from "next/image";

const IMAGE_PATHS = ["/pictures/a1.webp", "/pictures/a2.webp", "/pictures/a3.webp"] as const;
type ImagePath = (typeof IMAGE_PATHS)[number];
const DEFAULT_IMAGE_PATH = IMAGE_PATHS[0];
const SESSION_STORAGE_KEY = "gusm.login-animal-image";

type Props = Omit<React.ComponentProps<typeof Image>, "alt" | "height" | "src" | "width">;

function isImagePath(value: string | null): value is ImagePath {
  return IMAGE_PATHS.some(function hasImagePath(imagePath) {
    return imagePath === value;
  });
}

function getRandomImagePath() {
  const randomIndex = Math.floor(Math.random() * IMAGE_PATHS.length);
  return IMAGE_PATHS[randomIndex] ?? DEFAULT_IMAGE_PATH;
}

export function LoginAnimalImage({ className, ...props }: Props) {
  const [imagePath, setImagePath] = useState<ImagePath>(DEFAULT_IMAGE_PATH);

  useEffect(function selectImagePath() {
    const storedImagePath = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (isImagePath(storedImagePath)) {
      setImagePath(storedImagePath);
      return;
    }

    const randomImagePath = getRandomImagePath();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, randomImagePath);
    setImagePath(randomImagePath);
  }, []);

  return (
    <Image
      {...props}
      alt=""
      aria-hidden="true"
      className={clsx("size-full object-cover object-center", className)}
      height={48}
      src={imagePath}
      unoptimized
      width={48}
    />
  );
}
