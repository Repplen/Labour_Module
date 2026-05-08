import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function EmployeeQrCode({
  value,
  size = 240,
  onDataUrl,
  className = "",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const renderQrCode = async () => {
      if (!value || !canvasRef.current) return;

      const options = {
        width: size,
        margin: 2,
        color: {
          dark: "#111827",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      };

      await QRCode.toCanvas(canvasRef.current, value, options);
      const dataUrl = await QRCode.toDataURL(value, options);

      if (isMounted && onDataUrl) {
        onDataUrl(dataUrl);
      }
    };

    void renderQrCode();

    return () => {
      isMounted = false;
    };
  }, [onDataUrl, size, value]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      aria-label="Employee QR code"
    />
  );
}
