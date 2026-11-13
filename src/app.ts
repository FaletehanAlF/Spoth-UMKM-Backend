import express, { type Express, type Request, type Response } from 'express';

import routes from './routes/index.js';

const app: Express = express();

app.use(express.json());
app.use('/api', routes);

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello World!');
});

export default app;
