import Link from 'next/link'
import Image from 'next/image'

function getRandomArbitrary(max) {
  return Math.floor(Math.random() * max) + 1
}

function removeTags(str) {
  if (str === null || str === '') return false
  else str = str.toString()

  // Regular expression to identify HTML tags in
  // the input string. Replacing the identified
  // HTML tag with a null string.
  return str.replace(/(<([^>]+)>)/gi, '')
}

function truncate(str, no_words) {
  return str.split(' ').splice(0, no_words).join(' ')
}

export default function River({ post }) {
  const numz = getRandomArbitrary(5)
  const randomURL = `/images/whitewater${numz}-16x9-1024x576.jpg`
  console.log(numz)
  const imageURL = post.riverInfo?.imagez?.mediaItemUrl ?? randomURL

  return (
    <div className=' w-full px-10 py-6 bg-white rounded-lg shadow-md mt-6'>
      <Link href={post.slug}>
        <Image
          src={imageURL}
          alt='Chilean River'
          height={420}
          width={640}
          className='mb-4 rounded  mx-auto   bg-fixed opacity-100 hover:opacity-75 transition duration-300 ease-in-out bg-slate-600'
        />
      </Link>

      <div className='flex justify-between items-center'>
        <span className='text-gray-600 '>
          {post.riverInfo?.region ?? 'Region 8'}
        </span>
        <div className='text-gray-600 '>Class {post.riverInfo?.class ?? 3}</div>
      </div>
      <div className='mt-2'>
        <Link
          href={post.slug}
          className='text-xl text-gray-700 font-bold hover:underline'
        >
          {post.title}
        </Link>
        <div className='mt-2 text-gray-600'>
          {truncate(removeTags(post.excerpt), 20)}
        </div>

        <div className='flex justify-between items-center mt-6'>
          <Link href={post.slug} className='text-gray-900 hover:text-blue-600'>
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
