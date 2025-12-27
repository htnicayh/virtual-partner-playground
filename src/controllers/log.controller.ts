import { Body, Controller, Get, HttpStatus, Post, Res } from '@nestjs/common'
import { Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { LogEntry } from '../commons/interfaces/log-entry.interface'

@Controller()
export class LogController {
	private readonly logsDir = path.join(process.cwd(), 'logs')

	constructor() {
		if (!fs.existsSync(this.logsDir)) {
			fs.mkdirSync(this.logsDir, { recursive: true })
		}
	}

	@Post('/save')
	async saveLogs(@Body() body: { logs: LogEntry[] }, @Res() res: Response) {
		try {
			if (!body.logs || !Array.isArray(body.logs) || body.logs.length === 0) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					error: 'No logs provided',
					received: body
				})
			}

			const now = new Date()
			const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0]
			const timeStr = now.toISOString().split('T')[1].replace(/[:.]/g, '-').substring(0, 12)
			const filename = `client-logs-${dateStr}-${timeStr}.log`
			const filepath = path.join(this.logsDir, filename)

			const formattedLogs = body.logs
				.map((log) => `[${log.timestamp}] [${log.level}] ${log.context ? `[${log.context}] ` : ''}${log.message}`)
				.join('\n')

			fs.appendFileSync(filepath, formattedLogs + '\n\n', 'utf-8')

			console.log(`✓ Logs saved: ${filename} (${body.logs.length} entries)`)

			return res.status(HttpStatus.OK).json({
				success: true,
				filename,
				entriesCount: body.logs.length,
				path: `/logs/download/${filename}`
			})
		} catch (error) {
			console.error(`Failed to save logs: ${(error as Error).message}`)

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				error: 'Failed to save logs',
				message: (error as Error).message
			})
		}
	}

	@Get('/download/:filename')
	downloadLogs(@Res() res: Response, filename: string) {
		try {
			if (filename.includes('..') || filename.includes('/')) {
				return res.status(HttpStatus.BAD_REQUEST).json({
					error: 'Invalid filename'
				})
			}

			const filepath = path.join(this.logsDir, filename)

			if (!fs.existsSync(filepath)) {
				return res.status(HttpStatus.NOT_FOUND).json({
					error: 'Log file not found'
				})
			}

			res.download(filepath, filename, (err) => {
				if (err) {
					console.error(`Download error: ${err.message}`)
				}
			})
		} catch (error) {
			console.error(`Failed to download logs: ${(error as Error).message}`)

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				error: 'Failed to download logs',
				message: (error as Error).message
			})
		}
	}

	@Get('/list')
	listLogs(@Res() res: Response) {
		try {
			const files = fs.readdirSync(this.logsDir)
			const logFiles = files
				.filter((f) => f.endsWith('.log'))
				.map((f) => {
					const filepath = path.join(this.logsDir, f)
					const stats = fs.statSync(filepath)

					return {
						name: f,
						size: stats.size,
						created: stats.birthtime,
						modified: stats.mtime,
						url: `/logs/download/${f}`
					}
				})
				.sort((a, b) => b.modified.getTime() - a.modified.getTime())

			return res.status(HttpStatus.OK).json({
				total: logFiles.length,
				logs: logFiles
			})
		} catch (error) {
			console.error(`Failed to list logs: ${(error as Error).message}`)

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				error: 'Failed to list logs',
				message: (error as Error).message
			})
		}
	}

	@Post('/cleanup')
	cleanupLogs(@Body() body: { daysToKeep?: number }, @Res() res: Response) {
		try {
			const daysToKeep = body.daysToKeep || 7
			const cutoffDate = new Date()
			cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

			const files = fs.readdirSync(this.logsDir)
			let deletedCount = 0

			files.forEach((f) => {
				const filepath = path.join(this.logsDir, f)
				const stats = fs.statSync(filepath)

				if (stats.mtime < cutoffDate) {
					fs.unlinkSync(filepath)
					deletedCount++
					console.log(`Deleted old log: ${f}`)
				}
			})

			return res.status(HttpStatus.OK).json({
				success: true,
				deletedCount,
				daysToKeep,
				message: `Deleted ${deletedCount} old log files`
			})
		} catch (error) {
			console.error(`Failed to cleanup logs: ${(error as Error).message}`)

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				error: 'Failed to cleanup logs',
				message: (error as Error).message
			})
		}
	}
}
