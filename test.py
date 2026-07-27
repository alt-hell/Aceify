def print_paramid(n):
    for i in range(n):
        print(' ' * (n-i-1), end = '')
        print('* ' * (i + 1))

print_paramid(20)