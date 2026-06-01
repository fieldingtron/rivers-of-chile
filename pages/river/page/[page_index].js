import Layout from "../../../components/Layout"
import Link from 'next/link'
import River from '../../../components/River'
import Pagination from "../../../components/Pagination"

const POSTS_PER_PAGE = 6
const DEFAULT_API_URL = 'https://wp.riversofchile.com/graphql'

export default function RiverPage({ rivers, numPages,currentPage }) {
  return (
    <Layout>
      <h1 className='text-4xl font-bold border-b-4 p-2'>Popular Rivers</h1>
      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-5'>
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
      <Pagination currentPage={currentPage} numPages={numPages} />
    </Layout>
  )
}

async function getNumberOfRivers(){
  return 1
}

export async function getStaticPaths() {
  return { 
    paths: [{ params: { page_index: '1' } }], 
    fallback: false 
  }
}

import fs from 'fs'
import path from 'path'

export async function getStaticProps({params}) {
  const page = 1
  let river = [];
  try {
    const filePath = path.join(process.cwd(), 'data', 'sample-river.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileContents);
    if (json.data?.post) {
      river = [json.data.post];
    }
  } catch (error) {
    console.error('Error reading local sample-river.json', error);
  }

  return {
    props: {
      rivers: river, numPages: 1, currentPage: page 
    },
  }
}
