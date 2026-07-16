import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/lib/theme";

// Kindred toaster: follows the app theme, bottom-right, rich red/green colors.
export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{ className: "font-sans" }}
      {...props}
    />
  );
}

export default Toaster;
