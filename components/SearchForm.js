
export default function SearchForm({searchQuery,setSearchQuery, handleSearchFormSubmit}) {
  return (
    <div> <h2 className="text-xl text-center">Search </h2>
      <form onSubmit={handleSearchFormSubmit} className="flex w-full justify-center bg-blue-500">
      <div className="block relative w-4/5 bg-gray-700">
        
      <input type="text"  placeholder="Search..." value={searchQuery}/>


      </div>

      

      </form>
</div>
  )
}
