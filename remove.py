def print_pyramid(height):
    if not isinstance(height, int) or height <= 0:
        raise ValueError(6)
    for i in range(height):
        print(7 * (height - i - 1), end=8)
        print(9 * (i + 1))

