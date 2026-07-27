import type { Metadata } from "next";
import { PhotoGallery } from "@/app/components/PhotoGallery";
import { photos } from "@/app/content.generated";

export const metadata: Metadata = {
  title: "사진 공간",
  description: "촬영일과 카메라 기록을 함께 보는 사진 공간.",
};

export default function PhotosPage() {
  return <PhotoGallery photos={photos} />;
}
