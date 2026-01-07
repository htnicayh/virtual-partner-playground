import { Body, Controller, Post } from '@nestjs/common'

@Controller()
export class ChatController {
	constructor() {}

	@Post('message')
	async sendMessage(@Body() dto: unknown) {}
}
