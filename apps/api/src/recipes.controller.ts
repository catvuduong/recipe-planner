import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  parseCsv,
  parseId,
  parseOptionalWhole,
  parseRecipeCreate,
  parseRecipePatch,
  parseText,
} from './recipe-input.js';
import { RecipesService } from './recipes.service.js';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  // q: text in title, description or ingredients · tag · maxMinutes · have: comma-separated fridge items
  @Get()
  list(
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('maxMinutes') maxMinutes?: string,
    @Query('have') have?: string,
  ) {
    return this.recipes.list({
      q: parseText(q, 'q'),
      tag: parseText(tag, 'tag', 30)?.toLowerCase(),
      maxMinutes: parseOptionalWhole(maxMinutes, 'maxMinutes', 0),
      have: parseCsv(have, 'have'),
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @Query('servings') servings?: string) {
    return this.recipes.get(parseId(id), parseOptionalWhole(servings, 'servings', 1));
  }

  @Post()
  create(@Body() body: unknown) {
    return this.recipes.create(parseRecipeCreate(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.recipes.update(parseId(id), parseRecipePatch(body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.recipes.remove(parseId(id));
  }
}
