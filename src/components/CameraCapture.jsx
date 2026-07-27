import React, { useRef, useState, useEffect } from 'react';
import { Camera, X } from 'lucide-react';

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Prefer back camera
        });
        if (!active) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
      onCapture(file);
    }, 'image/jpeg', 0.8);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent text-white">
        <span className="font-bold drop-shadow-md">Take Photo</span>
        <button onClick={onCancel} className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition">
          <X size={24} />
        </button>
      </div>
      
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
          <p className="text-red-400 mb-2 font-semibold">Could not access camera</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="flex-1 w-full h-full object-cover bg-black"
        />
      )}

      {!error && (
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 flex justify-center bg-gradient-to-t from-black/60 to-transparent">
          <button
            onClick={handleCapture}
            className="h-16 w-16 bg-white rounded-full border-4 border-gray-400 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow-xl"
          >
            <Camera className="text-black" size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
