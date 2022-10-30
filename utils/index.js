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