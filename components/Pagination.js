import Link from "next/link"


export default function Pagination({currentPage,numPages}) {
  const isFirst = currentPage === 1
  const isLast = currentPage === numPages

  const prevPage = `/river/page/${currentPage -1}`
  const nextPage = `/river/page/${currentPage +1}`

  if (numPages === 1) return <></>

  return (
    <div className="mt-6">
      <ul className="flex flex-wrap pl-0 list-none my-2">
        {!isFirst && (
          <Link href={prevPage}>
            <li className="relative block py-2 px-3 leading-tight bg-white border border-gray-300 text-gray-800 mr-1 hover:bg-gray-200 cursor-pointer">
            Previous
            </li>
          </Link>
        )}
        
        {Array.from({ length: numPages }, (_, i) => (
          <Link href={`/river/page/${i + 1}`} key={`page-${i}`}>
            <li className='relative block py-2 px-3 leading-tight bg-white border border-gray-300 text-gray-800 mr-1 hover:bg-gray-200 cursor-pointer'>
              {i + 1}
            </li>
          </Link>
        ))}

        {!isLast && (
          <Link href={nextPage}>
            <li className="relative block py-2 px-3 leading-tight bg-white border border-gray-300 text-gray-800 mr-1 hover:bg-gray-200 cursor-pointer">
            Next
            </li>
          </Link>
        )}
      </ul>
      </div>
  )
}
