import Layout from "@/components/Layout"
import Link from 'next/link'
import River from '@/components/River'

export default function ClassRatingHome({ posts, riverclass }) {
  //console.log(posts)
  return (
    <Layout>
      <h1 className='text-4xl font-bold border-b-4 p-2'>Class {riverclass} Rivers in Chile</h1>

      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-5'>
        {posts.map((post, index) => (
          <River key={index} post={post} />
        ))}
      </div>

      <Link
        href='/river'
        className='block text-center border border-gray-500 text-gray-500 rounded-md py-4 my-5 transition duration ease select-none hover:text-white hover:bg-gray-900 focus:outline-none focus:shadow-outline w-full'
      >
        All Rivers
      </Link>
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
        posts(first: 2, where: {categoryNotIn: "158"}) {
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

  console.log('data here')
  console.log(json.data.posts.nodes)

  console.log("categories here")
  console.log(json.data.posts.nodes[0].categories)


  return {
    props: {
      posts: json.data.posts.nodes,
      riverclass : riverclass
    },
  }
}


export async function getStaticPaths() {

  const riverclasses = [1,2,3,4,5]
   
  const paths = riverclasses.map((riverclass) => ({
    params: { riverclass: riverclass.toString() },
  }))
  console.log(paths)

  return {
    paths,
    fallback: false,
  }
}