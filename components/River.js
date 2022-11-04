import Link from 'next/link'
import Image from 'next/image'
import CategoryLabel from './CategoryLabel'
import { getRandomArbitrary, truncate, removeTags,getClassOfRiver } from '../utils'

export default function River({ river }) {

  if (!river) {
    return null
  }
  const numz = getRandomArbitrary(5)
  const randomURL = `/images/whitewater${numz}-16x9-1024x576.jpg`
  const imageURL = river?.riverInfo?.imagez?.mediaItemUrl ?? randomURL

  const classNum = getClassOfRiver(river)

  return (
    <div className=' w-full px-10 py-6 bg-white rounded-lg shadow-md mt-6'>
      <Link href={`/river/${river.slug}`}>
        <Image
          src={imageURL}
          alt='Chilean River'
          height={420}
          width={640}
          className='mb-4 rounded mx-auto bg-fixed opacity-100 hover:opacity-75 transition duration-300 ease-in-out bg-slate-600'
        />
      </Link>

      <div className='flex justify-between items-center'>
        <span className='text-gray-600 '>
          {river.riverInfo?.region ?? 'Region 8'}
        </span>
        <CategoryLabel>{classNum}</CategoryLabel>
      </div>
      <div className='mt-2'>
        <Link
          href={`/river/${river.slug}`}
          className='text-xl text-gray-700 font-bold hover:underline'
        >
          {river.title}
        </Link>
        <div className='mt-2 text-gray-600'>
          {truncate(removeTags(river.excerpt), 20)}
        </div>

        <div className='flex justify-between items-center mt-6'>
          <Link
            href={`/river/${river.slug}`}
            className='text-gray-900 hover:text-blue-600'
          >
            Read More
          </Link>
          <div className='flex items-center'>
            <img
              src='/images/kurt-casey.jpg'
              className='mx-4 w-10 h-10 object-cover rounded-full hidden sm:block'
            />
            <h3 className='text-gray-700 font-bold'>Kurt Casey</h3>
          </div>
        </div>
      </div>
    </div>
  )
}
