
'use client'

import { useState } from 'react'
// import Navbar from '../components/Navbar'
// import Footer from '../components/Footer'
// import Home from '../components/Home'
import Home from '@pages/home'
import SignInForm from '@components/sign-in-form'

export default function Page() {
  const [isSignedIn, setIsSignedIn] = useState(false)

  const handleSignInSuccess = () => {
    setIsSignedIn(true)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* <Navbar /> */}
      <main className="flex-grow max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {!isSignedIn ? (
            <SignInForm onSignInSuccess={handleSignInSuccess} />
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900"></h1>
              <Home />
            </>
          )}
        </div>
      </main>
      {/* <Footer /> */}
    </div>
  )
}

