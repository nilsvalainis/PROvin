document.querySelector("input").addEventListener("input",(e)=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");});
