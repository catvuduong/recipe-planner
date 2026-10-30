import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { parseOptionalWhole } from './recipe-input.js';
import { PlanService, resolveWeek } from './plan.service.js';

@Controller('plan')
export class PlanController {
  constructor(private readonly plan: PlanService) {}

  @Get()
  week(@Query('week') week?: string) {
    return this.plan.week(resolveWeek(week));
  }

  // Quantities are scaled to `servings` people (default 2), not to each recipe's own servings.
  @Get('shopping-list')
  shoppingList(@Query('week') week?: string, @Query('servings') servings?: string) {
    return this.plan.shoppingList(
      resolveWeek(week),
      parseOptionalWhole(servings, 'servings', 1) ?? 2,
    );
  }

  @Put(':day/:slot')
  set(
    @Param('day') day: string,
    @Param('slot') slot: string,
    @Body() body: { recipeId?: unknown },
  ) {
    return this.plan.set(day, slot, body?.recipeId);
  }

  @Delete(':day/:slot')
  @HttpCode(HttpStatus.NO_CONTENT)
  clear(@Param('day') day: string, @Param('slot') slot: string) {
    return this.plan.clear(day, slot);
  }
}
