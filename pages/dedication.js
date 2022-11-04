import Layout from '@/components/Layout'

import {getAllRiversData} from "../utils"

export default function AboutPage() {
  return (
    <Layout title='Dedication Page'>
      <h1 className='text-5xl border-b-4 pb-5 font-bold'>Dedication</h1>
      <div className='bg-white shadow-md rounded-lg px-10 py-6 mt-6'>
        <h3 className='text-2xl mb-5'>Dedicated to John Foss</h3>
        <p className='mb-3'>In memory of John Foss</p>
        <p className='font-bold'>1960-200</p>
      </div>
    </Layout>
  )
}
