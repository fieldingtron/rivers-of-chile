import Layout from '../components/Layout'
import Image from 'next/image'

export default function NotFoundPage() {
  return (
    <Layout title='Page Not Found'>
      <div className='flex flex-col items-center mt-10'>
        <Image
          src='/images/dropit.jpg'
          width={200}
          height={200}
          alt='not found'
          className='bg-gray-800 rounded-2xl'
        />
        <h1 className='text-6xl my-5'>Error!</h1>
        <h2 className='text-4xl text-gray-400'>This Page does not Exist</h2>
      </div>
    </Layout>
  )
}
