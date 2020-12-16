let esbuild = require('esbuild')
let sass = require('sass')
let path = require('path')
let fs = require('fs-extra')

let scssPlugin = {
    name: 'scss',
    setup(build) {
        build.onLoad({filter: /\.scss$/}, async (args) => {
            return {
                contents: sass.renderSync({
                    file: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path)
                }).css,
                loader: 'text'
            }
        })
    }
}

const LICENSE = fs.readFileSync('./LICENSE')

const buildOptions = {
    entryPoints: ['src/js/background.js', 'src/js/content.js'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
    plugins: [scssPlugin],
    define: {
        'process.env.NODE_ENV': '"production"',
        'process.env.NODE_DEBUG': 'false'
    },
    banner: `/* ${LICENSE} */`,
    outdir: 'build',
    outbase: 'src'
};

esbuild.build(buildOptions)

const manifestFile = 'manifest.json'

fs.copy(path.join(buildOptions.outbase,manifestFile), path.join(buildOptions.outdir, manifestFile ))
fs.copy(path.join(buildOptions.outbase,'icons'), path.join(buildOptions.outdir, 'icons' ))
