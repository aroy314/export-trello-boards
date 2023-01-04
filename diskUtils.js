const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')

/**
 * writeData
 * writes the string on a file on disk
 * @param dataString
 * @param filename
 */
const writeData = (dataString, filename) => {
	const fileUrl = path.join(process.cwd(), filename) //Current Working Directory + filename
	return new Promise((resolve, reject) => {
		fs.writeFile(fileUrl, dataString, (err) => {
			if (err) {
				console.error('Error writing file ' + fileUrl, err.toString())
				return reject('Error writing file ' + fileUrl + ' ' + err.toString())
			}
			console.log('The file was saved as ' + fileUrl)
			return resolve(true)
		})
	})
}

const checkAccess = name =>
	new Promise((resolve, reject) => {
		try {
			fs.access(name, fs.constants.F_OK, function (err) {
				if (err) reject(err)
				else resolve()
			})
		} catch (err) {
			reject(err)
		}
	})

const pad2 = (n) => n.toString().padStart(2, '0')

const writeExport = boards => {
	// todo write each board in a JSON file in the folder /export/YYYY-MM-DD/board.name.json
	//create folders if no exists
	const today = new Date(),
		YYYY = today.getFullYear(),
		MM = pad2(today.getMonth() + 1),
		DD = pad2(today.getDate()),
		todayRelativePath = path.join('export', `${YYYY}-${MM}-${DD}`)

	return checkAccess(todayRelativePath)
		.catch(err => {
			//if no directory, we create it
			if (err && err.code === 'ENOENT') {
				console.log('Creating ' + todayRelativePath)
				return mkdirp(todayRelativePath)
			}
		})
		.then(() => {
			//write files
			return Promise.all(boards.map(board => {
				const nameCleaned = board.name.match(/[A-z0-9]/g).join(''),
					filename = path.join(todayRelativePath, nameCleaned + '.json')
				console.log('Writing file ' + filename)
				return writeData(JSON.stringify(board), filename)
			}))
		})
}

module.exports = {
	writeExport
}
