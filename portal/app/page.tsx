import { redirect } from "next/navigation";

// Root redirects to QR portal — token required in URL
export default function Home() {
  redirect("/qr");
}
