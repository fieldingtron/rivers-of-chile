import Layout from '@/components/Layout'
import CategoryLabel from '@/components/CategoryLabel'
import { getRandomArbitrary, truncate, removeTags,convDate }  from "@/utils/index"

export default function RiverPage({ river }) {

  const numz = getRandomArbitrary(5)
  const randomURL = `/images/whitewater${numz}-16x9-1024x576.jpg`
  const imageURL = river.riverInfo?.imagez?.mediaItemUrl ?? randomURL

  return (
    <Layout title={river.title}>
      <div className="w-full px-10 py-6 bg-white rounded-lg shadow-md mt6">
        <div className="flex justify-between items-center mt-4">
          <h1 className="text-5xl mb-7">
          {river.title}
          </h1>
          <CategoryLabel>{river.riverInfo.class}</CategoryLabel>
        </div>
        <img src={imageURL} alt={river.title} className="w-full rounded" />
        <div className="flex justify-between items-center bg-gray-100 p-2 my-8">
          <div className="flex items-center">
          <img
              src='/images/kurt-casey.jpg'
              className='mx-4 w-10 h-10 object-cover rounded-full hidden sm:block' alt="author kurt"
            />
            <h3 className='text-gray-700 font-bold'>Kurt Casey</h3>
          </div>
          <div className="mr-4">
            {convDate(river.date)}
          </div>

       

        </div>
        <div className="blog-text mt-2">
          <div dangerouslySetInnerHTML={{__html:river.content}}></div>
          </div>
       </div>
    </Layout>
  )
}

export async function getStaticProps({ params }) {

  const { API_URL } = process.env
  const response = await fetch(`${API_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
      query RiverNfo {
        post(id: "${params.slug}", idType: SLUG) {
          id
            title
            date
            authorId
            content
            slug
            excerpt 
            riverInfo {
              class
              imagez {
                mediaItemUrl
              }
            }
        }
      } `,
    }),
  })

  const json = await response.json()
  return {
    props: {
      river: json.data.post,
    },
  }
}

export async function getStaticPaths() {
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
            title
            date
            slug
          }
        }
      }`,
    }),
  })

  const json = await response.json()

  // Get the paths we want to pre-render based on posts
  const paths = json.data.posts.nodes.map((post) => ({
    params: { slug: post.slug },
  }))

  // We'll pre-render only these paths at build time.
  // { fallback: false } means other routes should 404.
  return { paths, fallback: false }
}
