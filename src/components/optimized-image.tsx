"use client";

import NextImage, { type ImageProps } from "next/image";
import imageLoader from "@/lib/image-loader";

export default function Image(props: ImageProps) {
  return <NextImage {...props} loader={props.loader ?? imageLoader} />;
}
