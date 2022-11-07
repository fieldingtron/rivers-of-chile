const fs = require('fs')

const ENCODED_URL ="aHR0cHM6Ly93cC5yaXZlcnNvZmNoaWxlLmNvbS9ncmFwaHFs"

const API_URL = Buffer.from(ENCODED_URL).toString('base64')

try {
  fs.readdirSync('cache')
} catch (error) {
  fs.mkdirSync('cache')
}

getAllRiversData()


 async function getAllRiversData() {
  ///const { API_URL } = process.env
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
            content
            slug
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

 try {
  const json = await response.json()
  const rivers = json.data.posts.nodes
  const riversMod = rivers.map(river=>{
    river.content = removeJunk(river.content)
    return river

  })

  const riverString = `export const rivers = ${JSON.stringify(rivers)}`
  
  fs.writeFile('cache/data.js', riverString, function (err) {
    if (err) return console.log(err)
    console.log('River Data Cached...')
  })

  // return rivers
 } catch (e){
  console.error(e)
 }

}


function removeJunk(str) {
  if (str === null || str === '') return false
  else str = str.toString()
  // Regular expression to identify HTML tags in
  // the input string. Replacing the identified
  // HTML tag with a null string.
  str = str.replace(/\\n/gi, ' ')
  str = str.replace(/\n/gi, ' ')
  str = str.replace(/(<([^>]+)>)/gi, '')
  return str
}