import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus'

@Controller()
export class HealthController {
	constructor(
		private readonly healthcheck: HealthCheckService,
		private readonly healthHttp: HttpHealthIndicator,
		private readonly memory: MemoryHealthIndicator
	) {}

	@Get('/')
	@HealthCheck()
	healthy() {
		return this.healthcheck.check([
			async () => this.healthHttp.pingCheck('google', 'https://google.com'),
			async () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
			async () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024)
		])
	}
}
