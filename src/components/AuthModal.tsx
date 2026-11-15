"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, CheckCircle, X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-card p-6 shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out">
          {/* Content は閉じるとアンマウントされるので、入力内容やエラー表示は
              閉じるたびに破棄され、次に開いたときは空の状態から始まる */}
          <AuthModalBody onClose={onClose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AuthModalBody({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activeTab, setActiveTab] = useState("login");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { login, register, resetPassword } = useAuth();

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const closeSoon = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => onClose(), 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const result = await login(email, password);
    if (result.success) {
      setMessage({ type: "success", text: "ログインしました" });
      closeSoon();
    } else {
      setMessage({
        type: "error",
        text: result.error || "ログインに失敗しました",
      });
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "パスワードが一致しません" });
      setIsLoading(false);
      return;
    }

    const result = await register(email, password);
    if (result.success) {
      setMessage({ type: "success", text: "アカウントを作成しました" });
      closeSoon();
    } else {
      setMessage({
        type: "error",
        text: result.error || "アカウント作成に失敗しました",
      });
    }
    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage({ type: "error", text: "メールアドレスを入力してください" });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    const result = await resetPassword(email);
    if (result.success) {
      setMessage({
        type: "success",
        text: "パスワードリセットメールを送信しました",
      });
    } else {
      setMessage({
        type: "error",
        text: result.error || "パスワードリセットに失敗しました",
      });
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Dialog.Title className="text-lg font-semibold">
            ログイン・新規登録
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            メールアドレスとパスワードでログイン、または新しく登録できます
          </Dialog.Description>
        </div>
        <Dialog.Close
          className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </Dialog.Close>
      </div>
      <Tabs
        value={activeTab}
        onValueChange={value => {
          setActiveTab(value);
          // 前のタブのエラーが残ると、別の操作の結果に見えてしまう
          setMessage(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">ログイン</TabsTrigger>
          <TabsTrigger value="register">新規登録</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">メールアドレス</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">パスワード</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "ログイン中..." : "ログイン"}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={handleResetPassword}
              disabled={isLoading}
              className="w-full"
            >
              パスワードを忘れた場合
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">メールアドレス</Label>
              <Input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">パスワード</Label>
              <Input
                id="register-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                aria-describedby="register-password-hint"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <p
                id="register-password-hint"
                className="text-xs text-muted-foreground"
              >
                6文字以上で設定してください
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">パスワード（確認用）</Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "登録中..." : "新規登録"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={`mt-4 p-3 rounded-md flex items-center space-x-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}
    </>
  );
}
