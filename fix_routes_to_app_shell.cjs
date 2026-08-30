const fs = require('fs')
const path = require('path')

const routeFiles = []

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) walk(file)
    else if (file.endsWith('page.tsx')) routeFiles.push(file)
  }
}

walk('app')

for (const file of routeFiles) {
  const dir = path.dirname(file)
  const relPath = path.relative(dir, 'App.tsx').replace(/\\/g, '/')
  const importPath = relPath.replace(/\.tsx$/, '')
  const text = `import App from '${importPath}'\n\nexport default App\n`
  fs.writeFileSync(file, text)
}

console.log(`Updated ${routeFiles.length} route wrappers to render the root App shell.`)
