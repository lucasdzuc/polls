import { prisma } from "../../lib/prisma";
import { FastifyInstance } from "fastify";
import { redis } from "../../lib/redis";
import z from "zod";

export async function getPoll(app: FastifyInstance){
  app.get('/polls/:pollId', async (request, reply) => {

    const getPollParms = z.object({
      pollId: z.string().uuid(),
    })
  
    const { pollId } = getPollParms.parse(request.params);
  
    const poll = await prisma.poll.findUnique({
      where: {
        id: pollId
      },
      include: {
        options: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if(!poll){
      return reply.status(400).send({ message: 'Poll not found!' });
    }

    const result = await redis.zrange(pollId, 0, -1, 'WITHSCORES');

    const votes = result.reduce((obj, line, index) => {
      if(index % 2 === 0){
        const score = result[index + 1];

        Object.assign(obj, { [line]: Number(score) });
      }

      return obj;
    }, {} as Record<string, number>);

    // console.log(request.body);
    // { pollId: poll.id }
    
    return reply.send({ 
      poll: {
        id: poll.id,
        title: poll.title,
        options: poll.options.map((option) => {
          return {
            id: option.id,
            title: option.title,
            score: (option.id in votes) ? votes[option.id] : 0
          }
        })
      }
     });
  });
}