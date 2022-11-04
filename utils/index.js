export const getRandomArbitrary = (max) => {
  return Math.floor(Math.random() * max) + 1
}

export const removeTags = str => {
  if (str === null || str === '') return false
  else str = str.toString()
  // Regular expression to identify HTML tags in
  // the input string. Replacing the identified
  // HTML tag with a null string.
  return str.replace(/(<([^>]+)>)/gi, '')
}

export const truncate = (str, no_words) => {
  return str.split(' ').splice(0, no_words).join(' ')
}

export const convDate = (input) =>{
  return new Date(input).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getClassOfRiver(river){
  //console.log(river)
  //return a string like a 1 or a 2 
  // first check the ACF custom field for class
  if (river?.riverInfo?.class) {
    return river.riverInfo.class.toString()
  }
  // then search wordpress categories
  river?.categories.nodes.forEach(cat=>{
    if (cat.name.match("class")){
      const clazz =  cat.name.substring(cat.name.length-2,cat.name.length).trim()
      return clazz
    }
  })
  // no matches ? then have have a default
  // default class is 3
  return "3"
}

export function filterRiversByClass  (classToMatch,rivers) {
    return rivers.filter((river,indexz) => {
      const riverClass = getClassOfRiver(river)
      if (classToMatch.toString()===riverClass) {
        return true
      } 
    });
}

