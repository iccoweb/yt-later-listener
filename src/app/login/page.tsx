import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in · Later Listener" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <LoginForm />
    </main>
  );
}
