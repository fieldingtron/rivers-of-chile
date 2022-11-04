import Link from 'next/link'

function classColor(number) {
  switch (number) {
    case '3':
      return 'bg-yellow-600'
      break
    case '4':
      return 'bg-orange-600'
      break
    case '5':
      return 'bg-red-600'
      break
    default:
      return 'bg-green-600'
  }
}

export default function CategoryLabel({ children }) {
  let bgcolor = classColor(children)
  return (
    <div className={`px-2 py-1 text-gray-100 ${bgcolor} font-bold rounded`}>
      <Link href={`/river/class/${children}`}>Class {children}</Link>
    </div>
  )
}
