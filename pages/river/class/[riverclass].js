import Layout from "@/components/Layout"
import Link from 'next/link'
import River from '@/components/River'
import { filterRiversByClass } from "@/utils/index"

export default function ClassRatingHome({ rivers, riverclass }) {
  const categories = [1,2,3,4,5]
  
  return (
    <Layout>
    <div className='flex justify-between flex-col lg:flex-row'>

    <div className='lg:w-3/4 lg:mr-10'>
      <h1 className='text-4xl font-bold border-b-4 p-2'>Class {riverclass} Rivers in Chile</h1>

        <div className='grid md:grid-cols-1 lg:grid-cols-2 gap-5'>
          {rivers.map((river, index) => (
            <River key={index} river={river} />
          ))}
        </div>

        <Link
          href='/river'
          className='block text-center border border-gray-500 text-gray-500 rounded-md py-4 my-5 transition duration ease select-none hover:text-white hover:bg-gray-900 focus:outline-none focus:shadow-outline w-full'
        >
          All Rivers
        </Link>

    </div>
    <div className='lg:w-1/4'>
          <h2 className="text-2xl font-bold border-b-2 p-2 text-center bg-gray-800 text-white rounded">River Classes</h2>
            <ul className="divide-y divide-gray-300">

              


            {categories.map((cat,key)=> <li key={key} className="pl-3 py-2 font-bold text-gray-600 text-center hover:bg-gray-200" ><Link href={`/river/class/${cat}`}>Class {cat}</Link></li>)}
            </ul>
         
        </div>
    </div>
          
    </Layout>
  )
}

export async function getStaticProps({ params: { riverclass } }) {
  const { API_URL } = process.env
  const response = await fetch(`${API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
      query GetPostsEdges {
        posts(first: 1000, where: {categoryNotIn: "158"}) {
          nodes {
            id
            title
            date
            authorId
            categories {
              nodes {
                id
                name
              }
            }
            slug
            excerpt 
            riverInfo {
              class
              imagez {
                mediaItemUrl
              }
            }
          }
        }
      }`,
    }),
  })

  const json = await response.json()

  console.log(`searching for RIVER CLASS ${riverclass} among ${json.data.posts.nodes.length} elements`)

  const filteredRivers = filterRiversByClass(riverclass,json.data.posts.nodes)
  console.log(filteredRivers.length)


  return {
    props: {
      rivers: filteredRivers,
      riverclass : riverclass
    },
  }
}


export async function getStaticPaths() {

  const riverclasses = [1,2,3,4,5]
   
  const paths = riverclasses.map((riverclass) => ({
    params: { riverclass: riverclass.toString() },
  }))

  return {
    paths,
    fallback: false,
  }
}