import { useRef } from 'react';

interface PhotoUploaderProps {
  photos: File[];
  onChange: (photos: File[]) => void;
}

export default function PhotoUploader({ photos, onChange }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    onChange([...photos, ...newFiles]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Destination Photos (optional)
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center
                   cursor-pointer hover:border-blue-500/50 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFiles}
          className="hidden"
        />
        <div className="text-gray-400">
          <svg className="mx-auto h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Click to add photos from your destination</p>
          <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP supported</p>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {photos.map((photo, i) => (
            <div key={i} className="relative group">
              <img
                src={URL.createObjectURL(photo)}
                alt={`Destination photo ${i + 1}`}
                className="w-full h-20 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full text-xs
                           text-white opacity-0 group-hover:opacity-100 transition-opacity
                           flex items-center justify-center"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
