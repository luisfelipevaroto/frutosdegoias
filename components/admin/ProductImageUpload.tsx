"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const BUCKET = "produto-imagens";
const MAX_SIZE = 5 * 1024 * 1024;

interface Props {
  value?: string;
  onChange: (url: string) => void;
}

export default function ProductImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem (JPG, PNG ou WebP).");
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `produtos/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="mb-3">
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3">
        {value ? (
          <div className="space-y-3">
            <img
              src={value}
              alt="Prévia do produto"
              className="h-40 w-full rounded-lg object-cover"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
              >
                {uploading ? "Enviando..." : "Trocar imagem"}
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-lg border px-3 py-2 text-sm text-red-600"
              >
                Remover
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-32 w-full flex-col items-center justify-center gap-1 text-sm text-neutral-500"
          >
            <span className="text-2xl">📷</span>
            <span className="font-medium text-neutral-700">
              {uploading ? "Enviando imagem..." : "Clique para enviar uma imagem"}
            </span>
            <span className="text-xs">JPG, PNG ou WebP · até 5 MB</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.currentTarget.value = "";
        }}
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
