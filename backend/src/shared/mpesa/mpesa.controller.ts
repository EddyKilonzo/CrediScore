import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MpesaService } from './mpesa.service';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('M-Pesa')
@Controller('mpesa')
export class MpesaController {
  constructor(private readonly mpesaService: MpesaService) {}

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M-Pesa payment callback (Daraja)' })
  handleCallback(@Body() body: any) {
    this.mpesaService.handleCallback(body);
    return { ResultCode: 0, ResultDesc: 'Success' };
  }

  @Public()
  @Post('timeout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M-Pesa timeout callback (Daraja)' })
  handleTimeout(@Body() body: any) {
    return { ResultCode: 0, ResultDesc: 'Success' };
  }
}
