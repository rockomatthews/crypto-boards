'use client';

import React, { useState } from 'react';
import Slider from 'react-slick';
import { Box, Card, CardContent, CardMedia, Typography, Button } from '@mui/material';
import { CreateGameModal } from './CreateGameModal';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

const games = [
  {
    id: 1,
    title: 'Checkers',
    description: 'Classic strategy game with a crypto twist. Play and earn!',
    image: '/images/checkers.png',
    minPlayers: 2,
    maxPlayers: 2,
    entryFee: '0.1 SOL',
    route: '/checkers'
  },
  {
    id: 2,
    title: 'Chess',
    description: 'The ultimate battle of wits. Stake your SOL and prove your mastery.',
    image: '/images/chess.png',
    minPlayers: 2,
    maxPlayers: 2,
    entryFee: '0.2 SOL',
    route: '/chess'
  },
  {
    id: 3,
    title: 'Stratego',
    description: 'The most fun board game ever hooked on SOL',
    image: '/images/stratego.png',
    minPlayers: 2,
    maxPlayers: 2,
    entryFee: '0.15 SOL',
    route: '/go'
  },
  {
    id: 4,
    title: 'Shoots & Ladders',
    description: 'Stay tuned and plan to get vertical',
    image: '/images/shootsAndLadders.png',
    minPlayers: 2,
    maxPlayers: 6,
    entryFee: '0.5 SOL',
    route: '/poker'
  }
];

export default function GameCarousel() {
  const [modalOpen, setModalOpen] = useState(false);

  const handlePlayNow = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    arrows: true,
    responsive: [
      {
        breakpoint: 1400,
        settings: {
          slidesToShow: 3,
        }
      },
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
        }
      }
    ]
  };

  return (
    <>
      <Box sx={{ 
        width: '100%', 
        maxWidth: '1600px', 
        mx: 'auto', 
        mt: 4,
        mb: 6,
        px: { xs: 2, md: 6 },
      }}>
        {/* Title Section */}
        <Box sx={{ 
          textAlign: 'center', 
          mb: 4,
          px: 2 
        }}>
          <Typography 
            variant="h3" 
            component="h1" 
            sx={{ 
              fontFamily: 'MK5Style, monospace',
              fontSize: { xs: '1.8rem', sm: '2.5rem', md: '3rem' },
              color: '#9c27b0',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              lineHeight: 1.2,
              mb: 2
            }}
          >
            In the land of no copyRIGHTS, will you bet your SOL?
          </Typography>
        </Box>
      </Box>

      <Box sx={{ 
        width: '100%', 
        maxWidth: '1600px', 
        mx: 'auto', 
        mt: 4,
        mb: 6,
        px: { xs: 2, md: 6 },
        '& .slick-prev': {
          left: { xs: -20, md: -40 },
          zIndex: 1,
        },
        '& .slick-next': {
          right: { xs: -20, md: -40 },
          zIndex: 1,
        },
        '& .slick-prev, & .slick-next': {
          width: 40,
          height: 40,
          '&:before': {
            fontSize: 40,
          },
        },
      }}>
        <Slider {...settings}>
          {games.map((game) => (
            <Box key={game.id} sx={{ px: 1 }}>
              <Card 
                sx={{ 
                  position: 'relative',
                  borderRadius: 4,
                  overflow: 'hidden',
                  height: { xs: '300px', md: '400px' },
                  background: 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)',
                  transition: 'transform 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'scale(1.02)',
                  }
                }}
              >
                <CardMedia
                  component="img"
                  height="100%"
                  image={game.image}
                  alt={game.title}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.7,
                    zIndex: 0
                  }}
                />
                <CardContent
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
                    p: 3
                  }}
                >
                  <Typography variant="h5" component="h2" sx={{ 
                    color: 'white',
                    mb: 1,
                    fontWeight: 700,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                  }}>
                    {game.title}
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    color: 'white',
                    mb: 3,
                    maxWidth: '100%',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {game.description}
                  </Typography>
                  <Button 
                    variant="contained" 
                    size="medium"
                    onClick={() => handlePlayNow()}
                    sx={{ 
                      alignSelf: 'flex-start',
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      background: 'linear-gradient(45deg, #9c27b0 30%, #00e676 90%)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #7b1fa2 30%, #00c853 90%)',
                      }
                    }}
                  >
                    Play Now
                  </Button>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Slider>
      </Box>

      <CreateGameModal
        open={modalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
} 