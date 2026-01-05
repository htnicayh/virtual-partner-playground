import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'

@Injectable()
export class S3Service {
	private readonly logger: Logger = new Logger(S3Service.name)

	private readonly s3: S3Client
	private readonly bucket: string
	private readonly endpoint: string
	private readonly region: string
	private readonly publicURL: string

	constructor(private readonly configService: ConfigService) {
		this.bucket = this.configService.get<string>('S3_BUCKET') as string
		this.endpoint = this.configService.get<string>('S3_ENDPOINT') as string
		this.region = this.configService.get<string>('S3_REGION') as string
		this.publicURL = this.configService.get<string>('S3_PUBLIC_URL') as string

		if (!this.bucket || !this.endpoint || !this.region) {
			throw new Error('S3_BUCKET, S3_ENDPOINT and S3_REGION are required')
		}

		this.logger.log(`Using S3 bucket: ${this.bucket}`)
		this.logger.log(`Using S3 endpoint: ${this.endpoint}`)
		this.logger.log(`Using S3 region: ${this.region}`)

		this.s3 = new S3Client({
			region: this.region,
			endpoint: `https://${this.endpoint}`,
			credentials: {
				accessKeyId: this.configService.get<string>('S3_ACCESS_KEY') as string,
				secretAccessKey: this.configService.get<string>('S3_APPLICATION_KEY') as string
			}
		})
	}

	async uploadWithBuffer(
		buffer: Buffer,
		contentType: string,
		folder = 'ea73988d-62e3-45f2-9e84-18a464426abd'
	): Promise<string> {
		try {
			const key = `${folder}/${randomUUID()}.mp3`

			this.logger.log(`Uploading to S3: ${key}`)

			await this.s3.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: buffer,
					ContentType: contentType
				})
			)

			const url = `${this.publicURL}/${key}`

			this.logger.log(`Uploaded to S3: ${url}`)

			return url
		} catch (e) {
			this.logger.error(`Error uploading to S3: ${(e as Error).message}`)

			throw e
		}
	}
}
