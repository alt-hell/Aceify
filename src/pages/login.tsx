import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight } from "lucide-react"

export function Login({ onLogin }: { onLogin: () => void }) {
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const isDev = (import.meta as any).env.MODE === 'development'
      const baseUrl = isDev ? 'http://localhost:3001' : ''

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password })
      })

      const data = await res.json()

      if (data.success) {
        onLogin()
        navigate("/")
      } else {
        setError(data.error || "Invalid User ID or Password")
      }
    } catch (err) {
      setError("Failed to connect to authentication server")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-background overflow-hidden p-4">
      {/* Animated aurora background */}
      <div className="aurora-bg absolute inset-0 z-0" />

      {/* Title bar drag region */}
      <div className="absolute top-0 left-0 right-0 h-[32px] z-50" style={{ WebkitAppRegion: 'drag' } as any} />

      {/* Decorative gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-float-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px] animate-float-glow pointer-events-none" style={{ animationDelay: '3s' }} />

      {/* Login card */}
      <div
        className="animate-fade-up relative z-10 w-full max-w-[420px] rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-2xl shadow-primary/5"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary glow-blue">
            <Sparkles className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Aceify</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to access your Interview Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* User ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">User ID</label>
            <input
              type="text"
              className="flex h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 py-2 text-sm text-foreground transition-all placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-[0_0_20px_-8px_rgba(var(--primary),0.3)]"
              placeholder="Enter your User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="flex h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 py-2 pr-10 text-sm text-foreground transition-all placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-[0_0_20px_-8px_rgba(var(--primary),0.3)]"
                placeholder="Enter your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="animate-fade-up rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm font-medium text-red-400 text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !userId.trim() || !password.trim()}
            className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all glow-blue hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Authenticating…
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          {/* Keyboard hint */}
          <p className="text-center text-[11px] text-muted-foreground/50">
            Press <kbd className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono">Enter</kbd> to sign in
          </p>
        </form>
      </div>
    </div>
  )
}
