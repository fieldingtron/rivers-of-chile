import Link from 'next/link'
import Image from 'next/image'

export default function Header() {
  return (
    <header className='bg-gray-900 text-gray-100 shadow w-full'>
      <div className='container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center'>
        <Link
          href='/'
          className='flex md:w-2/5 title-font font-medium items-center md:justify-start mb-4 md:mb-0'
        >
          <Image
            src='/images/rivers-64x64.png'
            width={64}
            height='64'
            alt='logo'
          />
          <span className='ml-2 text-xl'>Rivers Of Chile</span>
        </Link>
        <nav className='flex flex-wrap md:w-3/5 items-center justify-end text-base md:ml-auto'>
          <Link
            href='/river/'
            className='mx-5 cursor-pointer uppercase hover:text-indigo-300'
          >
            Rivers Search
          </Link>
          <Link
            href='/dedication/'
            className='mx-5 cursor-pointer uppercase hover:text-indigo-300'
          >
            Dedication
          </Link>
          <Link
            href='/authors/'
            className='mx-5 cursor-pointer uppercase hover:text-indigo-300'
          >
            Authors
          </Link>
        </nav>
      </div>
    </header>
  )
}
