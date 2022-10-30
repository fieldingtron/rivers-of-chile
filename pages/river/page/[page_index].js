import Layout from "../../../components/Layout"
import Link from 'next/link'
import River from '../../../components/River'

export default function RiverPage({ posts }) {
  //console.log(posts)
  return (
    <Layout>
      <h1 className='text-4xl font-bold border-b-4 p-2'>Popular Rivers</h1>

      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-5'>
        {posts.map((post, index) => (
          <River key={index} post={post} />
        ))}
      </div>

      <Link
        href='/blog'
        className='block text-center border border-gray-500 text-gray-500 rounded-md py-4 my-5 transition duration ease select-none hover:text-white hover:bg-gray-900 focus:outline-none focus:shadow-outline w-full'
      >
        All Rivers
      </Link>
    </Layout>
  )
}

async function getNumberOfRivers(){
  const { API_URL } = process.env
  const response = await fetch(`${API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
      query GetPostsEdges {
        posts(first: 100, where: {categoryNotIn: "158"}) {
          nodes {
            id
            title
          }
        }
      }`,
    }),
  })
  //console.log('json search')
  const json = await response.json()
  //console.log(json.data.posts.nodes)
  return json.data.posts.nodes.length
}

export async function getStaticPaths() {
  const riversPerPage = 6
  const numRivers = await getNumberOfRivers()
  console.log(numRivers)
  const numPages = Math.ceil(numRivers/riversPerPage)
  const paths = []
  for (let index = 1; index <= numPages; index++) {
    paths.push({
      params: { page_index: index.toString() },
    })
  }

  console.log(paths)
  
  return { paths, fallback: false }
}

export async function getStaticProps() {
  const { API_URL } = process.env
  const response = await fetch(`${API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
      query GetPostsEdges {
        posts(first: 100, where: {categoryNotIn: "158"}) {
          nodes {
            id
            title
            date
            authorId
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

  // console.log('data here')
  //console.log(json.data.posts.nodes)

  return {
    props: {
      posts: json.data.posts.nodes,
    },
  }
}
