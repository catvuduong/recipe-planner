import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbService } from './db.service.js';
import { PlanController } from './plan.controller.js';
import { PlanService } from './plan.service.js';
import { RecipesController } from './recipes.controller.js';
import { RecipesService } from './recipes.service.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [],
  controllers: [AppController, RecipesController, PlanController],
  providers: [AppService, DbService, RecipesService, PlanService, SeedService],
})
export class AppModule {}
