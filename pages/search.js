import Layout from '../components/Layout'
import Image from 'next/image'
import SearchForm from '../components/SearchForm'

export default function SearchPage() {
  return (
    <Layout title='Search Page'>
      <div className='flex flex-col items-center mt-10'>
        <Image
          src='/images/dropit.jpg'
          width={200}
          height={200}
          alt='not found'
          className='bg-gray-800 rounded-2xl'
        />
        <h1 className='text-6xl my-5'>Search Away!</h1>
        <SearchForm/>
        <h2 className='text-4xl text-gray-400'>Seek and you will find</h2>
      </div>
    </Layout>
  )
}
