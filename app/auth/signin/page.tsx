'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Suspense } from 'react'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const result = await signIn('credentials', {
      username: values.username,
      password: values.password,
      redirect: false,
    })

    if (result?.error) {
      setError('root', { message: 'Invalid username or password.' })
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
      <div className="bg-white rounded-[12px] shadow-card w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-[22px] font-semibold font-heading text-[#1a2332]">Finance Tracker</h1>
          <p className="text-[#6b7a8d] text-sm mt-1">Sign in to continue</p>
        </div>

        {(error || errors.root) && (
          <div className="mb-4 rounded-[8px] bg-[#fef2f2] border border-[#ef4444]/20 px-4 py-3 text-sm text-[#ef4444]">
            {errors.root?.message ?? 'Invalid username or password.'}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">
              Username
            </label>
            <input
              {...register('username')}
              type="text"
              autoComplete="username"
              className="w-full h-[40px] px-3 rounded-[8px] border border-[#e8ecf0] text-sm text-[#1a2332] outline-none focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c] transition-colors"
            />
            {errors.username && (
              <p className="mt-1 text-xs text-[#ef4444]">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">
              Password
            </label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="w-full h-[40px] px-3 rounded-[8px] border border-[#e8ecf0] text-sm text-[#1a2332] outline-none focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c] transition-colors"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-[#ef4444]">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-[36px] rounded-[8px] bg-[#00b89c] text-white text-sm font-medium font-heading hover:bg-[#009e87] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
